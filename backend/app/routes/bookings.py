from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import db

router = APIRouter(tags=["Bookings"])


class BookingCreate(BaseModel):
    event_type_id: str
    attendee_name: str
    attendee_email: str
    date: str
    time: str


def parse_range_start_to_minutes(value: str) -> Optional[int]:
    if not value:
        return None

    start = value.split("-")[0].split("–")[0].strip()
    try:
        parsed = datetime.strptime(start, "%I:%M %p")
        return parsed.hour * 60 + parsed.minute
    except ValueError:
        return None


@router.get("/bookings")
async def list_bookings(tab: Optional[str] = "upcoming"):
    status_map = {
        "upcoming": "upcoming",
        "unconfirmed": "unconfirmed",
        "recurring": "recurring",
        "past": "completed",
        "cancelled": "cancelled",
    }

    status_filter = status_map.get(tab.lower(), "upcoming") if tab else "upcoming"

    bookings = await db.booking.find_many(
        where={"status": status_filter},
        include={"eventType": True},
        order={"createdAt": "desc"},
    )

    result = []
    for b in bookings:
        result.append({
            "id": b.id,
            "title": b.eventType.name if b.eventType else "Unknown",
            "attendee": b.attendeeName,
            "email": b.attendeeEmail,
            "date": b.date,
            "time": b.time,
            "status": b.status,
            "tab": tab,
            "createdAt": b.createdAt.isoformat() if b.createdAt else None,
        })

    return {"bookings": result}


@router.post("/bookings", status_code=201)
async def create_booking(body: BookingCreate):
    event_type = await db.eventtype.find_unique(where={"id": body.event_type_id})
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found")

    requested_start = parse_range_start_to_minutes(body.time)
    if requested_start is None:
        raise HTTPException(status_code=400, detail="Invalid time format")

    existing_for_day = await db.booking.find_many(where={"date": body.date})
    occupied_starts = {
        parsed_start
        for booking in existing_for_day
        for parsed_start in [parse_range_start_to_minutes(booking.time)]
        if booking.status != "cancelled"
        if parsed_start is not None
    }

    if requested_start in occupied_starts:
        raise HTTPException(status_code=409, detail="Selected time is no longer available")

    booking = await db.booking.create(
        data={
            "eventTypeId": body.event_type_id,
            "attendeeName": body.attendee_name,
            "attendeeEmail": body.attendee_email,
            "date": body.date,
            "time": body.time,
            "status": "upcoming",
        }
    )
    return {
        "booking": {
            "id": booking.id,
            "eventTypeId": booking.eventTypeId,
            "name": booking.attendeeName,
            "email": booking.attendeeEmail,
            "eventTitle": event_type.name,
            "date": booking.date,
            "time": booking.time,
            "status": booking.status,
            "joinUrl": f"https://cal.com{event_type.slug}",
        }
    }
