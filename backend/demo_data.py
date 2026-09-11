from app import create_app, db
from models import Assignment, AssignmentStatus, Location, Operation, OperationStatus, Vehicle, VehicleAssignment, VehicleStatus
from services.journal_service import create_journal_entry, create_system_event


def seed_demo_data():
    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()

        operation = Operation(number='2026-001', title='Unwetterlage Stadtgebiet', description='Mehrere wetterbedingte Einsätze', status=OperationStatus.ACTIVE)
        historic_operation = Operation(number='2025-014', title='Sturmereignis Vorjahr', description='Archivierte Lage', status=OperationStatus.CLOSED)
        db.session.add_all([operation, historic_operation])
        db.session.flush()

        locations = [
            Location(name='Wache Mitte', address='Musterstraße 1, Frankfurt', latitude=50.1109, longitude=8.6821),
            Location(name='Wache Nord', address='Nordring 12, Frankfurt', latitude=50.1402, longitude=8.6922),
            Location(name='Bereitstellung Süd', address='Südring 20, Frankfurt', latitude=50.0908, longitude=8.6623),
        ]
        db.session.add_all(locations)
        db.session.flush()

        vehicles = [
            Vehicle(callsign='Florian 1-11-1', vehicle_type='ELW', crew_count=3, location_id=locations[0].id, status=VehicleStatus.AVAILABLE),
            Vehicle(callsign='Florian 1-44-1', vehicle_type='HLF', crew_count=9, location_id=locations[0].id, status=VehicleStatus.ALERTED),
            Vehicle(callsign='Florian 2-46-1', vehicle_type='LF', crew_count=8, location_id=locations[1].id, status=VehicleStatus.EN_ROUTE),
            Vehicle(callsign='Florian 3-19-1', vehicle_type='MTW', crew_count=4, location_id=locations[2].id, status=VehicleStatus.UNAVAILABLE),
            Vehicle(callsign='Florian 4-65-1', vehicle_type='RW', crew_count=3, location_id=locations[1].id, status=VehicleStatus.OUT_OF_SERVICE),
        ]
        db.session.add_all(vehicles)
        db.session.flush()

        assignments = [
            Assignment(operation_id=operation.id, number='2026-001-001', title='Baum auf Fahrbahn', description='Zufahrt blockiert', location_address='Mainzer Landstraße 1, Frankfurt', latitude=50.1075, longitude=8.6642, status=AssignmentStatus.OPEN),
            Assignment(operation_id=operation.id, number='2026-001-002', title='Wassereintritt Keller', description='Mehrfamilienhaus betroffen', location_address='Berger Straße 120, Frankfurt', latitude=50.1240, longitude=8.7098, status=AssignmentStatus.ASSIGNED),
            Assignment(operation_id=operation.id, number='2026-001-003', title='Abgedecktes Dach', description='Sicherung mit Drehleiter', location_address='Hanauer Landstraße 88, Frankfurt', latitude=50.1124, longitude=8.7393, status=AssignmentStatus.IN_PROGRESS),
            Assignment(operation_id=operation.id, number='2026-001-004', title='Straße überflutet', description='Einsatz abgeschlossen', location_address='Schweizer Straße 44, Frankfurt', latitude=50.1008, longitude=8.6787, status=AssignmentStatus.COMPLETED),
        ]
        db.session.add_all(assignments)
        db.session.flush()

        db.session.add_all([
            VehicleAssignment(vehicle_id=vehicles[1].id, assignment_id=assignments[1].id, order=1),
            VehicleAssignment(vehicle_id=vehicles[2].id, assignment_id=assignments[2].id, order=1),
        ])

        db.session.add_all([
            create_system_event(operation.id, f'Einsatzlage "{operation.title}" erstellt', entry_type='operation_created'),
            create_system_event(operation.id, f'Auftrag {assignments[0].number} erstellt: {assignments[0].title}', assignment_id=assignments[0].id, entry_type='assignment_created'),
            create_system_event(operation.id, f'Auftrag {assignments[1].number} erstellt: {assignments[1].title}', assignment_id=assignments[1].id, entry_type='assignment_created'),
            create_system_event(operation.id, f'Fahrzeug {vehicles[1].callsign} zu Auftrag {assignments[1].number} zugewiesen', assignment_id=assignments[1].id, entry_type='vehicle_assigned'),
            create_system_event(operation.id, f'Fahrzeug {vehicles[2].callsign}: Status geändert: available → en_route', assignment_id=assignments[2].id, entry_type='vehicle_status_changed'),
            create_system_event(operation.id, f'Auftrag {assignments[2].number}: Status geändert: assigned → in_progress', assignment_id=assignments[2].id, entry_type='assignment_status_changed'),
            create_system_event(operation.id, f'Auftrag {assignments[3].number} abgeschlossen', assignment_id=assignments[3].id, entry_type='assignment_completed'),
            create_journal_entry(operation.id, 'Rückmeldung Einsatzleiter: Keller weitgehend leergepumpt.', assignment_id=assignments[1].id, entry_type='note'),
            create_journal_entry(operation.id, 'Bereitstellungsraum Süd meldet noch zwei verfügbare Kräfte.', entry_type='info'),
            create_system_event(historic_operation.id, 'Einsatzlage geschlossen', entry_type='operation_closed'),
        ])
        db.session.commit()
        print('Demo data created.')


if __name__ == '__main__':
    seed_demo_data()
