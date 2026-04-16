from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from prisma import Json
from app.database import db

router = APIRouter(tags=["Availability"])


class ScheduleCreate(BaseModel):
    name: str
    timezone: str = "Europe/London"
    schedule: dict = {}


def parse_hhmm_to_minutes(value: str) -> int:
    hour_str, minute_str = value.split(":")
    return int(hour_str) * 60 + int(minute_str)


def parse_range_start_to_minutes(value: str) -> Optional[int]:
    if not value:
        return None

    start = value.split("-")[0].split("–")[0].strip()
    try:
        parsed = datetime.strptime(start, "%I:%M %p")
        return parsed.hour * 60 + parsed.minute
    except ValueError:
        return None


def format_minutes_to_ampm(total_minutes: int) -> str:
    hour_24 = total_minutes // 60
    minute = total_minutes % 60
    suffix = "AM" if hour_24 < 12 else "PM"
    hour_12 = hour_24 % 12
    if hour_12 == 0:
        hour_12 = 12
    return f"{hour_12}:{minute:02d} {suffix}"


def format_slot(start_minutes: int, duration_minutes: int) -> str:
    end_minutes = start_minutes + duration_minutes
    return f"{format_minutes_to_ampm(start_minutes)} - {format_minutes_to_ampm(end_minutes)}"


@router.get("/availability")
async def list_schedules(eventTypeId: Optional[str] = None, date: Optional[str] = None):
    if eventTypeId and date:
        event_type = await db.eventtype.find_unique(where={"id": eventTypeId})
        if not event_type:
            raise HTTPException(status_code=404, detail="Event type not found")

        try:
            weekday_name = datetime.strptime(date, "%Y-%m-%d").strftime("%A")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format, expected YYYY-MM-DD")

        schedule = await db.availabilityschedule.find_first(where={"isDefault": True})
        if not schedule:
            schedule = await db.availabilityschedule.find_first()

        if not schedule or not isinstance(schedule.schedule, dict):
            return {"slots": []}

        day_window = schedule.schedule.get(weekday_name)
        if not day_window:
            return {"slots": []}

        from_value = day_window.get("from")
        to_value = day_window.get("to")
        if not from_value or not to_value:
            return {"slots": []}

        start_minutes = parse_hhmm_to_minutes(from_value)
        end_minutes = parse_hhmm_to_minutes(to_value)
        duration = int(event_type.duration)

        if end_minutes <= start_minutes or duration <= 0:
            return {"slots": []}

        existing_bookings = await db.booking.find_many(where={"date": date})
        occupied_starts = {
            parse_range_start_to_minutes(booking.time)
            for booking in existing_bookings
            if booking.status != "cancelled"
        }

        slots = []
        for cursor in range(start_minutes, end_minutes - duration + 1, 15):
            if cursor in occupied_starts:
                continue
            slots.append(format_slot(cursor, duration))

        return {"slots": slots}

    schedules = await db.availabilityschedule.find_many(order={"createdAt": "asc"})
    return {"schedules": schedules}


@router.post("/availability", status_code=201)
async def create_schedule(body: ScheduleCreate):
    schedule = await db.availabilityschedule.create(
        data={
            "name": body.name,
            "timezone": body.timezone,
            "isDefault": False,
            "schedule": Json(body.schedule),
        }
    )
    return {"schedule": schedule}


@router.delete("/availability/{schedule_id}")
async def delete_schedule(schedule_id: str):
    existing = await db.availabilityschedule.find_unique(where={"id": schedule_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Schedule not found")

    await db.availabilityschedule.delete(where={"id": schedule_id})
    return {"deleted": True}
