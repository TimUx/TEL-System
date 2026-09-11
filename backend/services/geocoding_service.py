import os
from threading import Thread

from geopy.geocoders import Nominatim

from app import db
from models import Assignment, Location


DEFAULT_GEOCODER_TIMEOUT = float(os.environ.get('GEOCODER_TIMEOUT_SECONDS', '2.0'))



def _build_geolocator():
    return Nominatim(user_agent='tel-system', timeout=DEFAULT_GEOCODER_TIMEOUT)



def geocode_address(address):
    if not address:
        return None
    geolocator = _build_geolocator()
    result = geolocator.geocode(address)
    if not result:
        return None
    return result.latitude, result.longitude



def _update_coordinates_async(app, model_class, object_id, address):
    with app.app_context():
        coordinates = geocode_address(address)
        if not coordinates:
            return
        entity = db.session.get(model_class, object_id)
        if not entity:
            return
        current_address = entity.location_address if model_class is Assignment else entity.address
        if current_address != address:
            return
        entity.latitude, entity.longitude = coordinates
        db.session.commit()



def _schedule(app, model_class, object_id, address):
    if not address:
        return
    thread = Thread(
        target=_update_coordinates_async,
        args=(app, model_class, object_id, address),
        daemon=True,
    )
    thread.start()



def schedule_assignment_geocoding(app, assignment_id, address):
    _schedule(app, Assignment, assignment_id, address)



def schedule_location_geocoding(app, location_id, address):
    _schedule(app, Location, location_id, address)
