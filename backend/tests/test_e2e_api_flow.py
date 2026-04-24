import os
import threading
import time

import pytest
import requests
from werkzeug.serving import make_server

from app import create_app, db

pytestmark = pytest.mark.e2e


class _ServerThread(threading.Thread):
    def __init__(self, app, host='127.0.0.1', port=5055):
        super().__init__(daemon=True)
        self.server = make_server(host, port, app)
        self.ctx = app.app_context()
        self.ctx.push()

    def run(self):
        self.server.serve_forever()

    def shutdown(self):
        self.server.shutdown()
        self.ctx.pop()


def test_e2e_full_http_flow(tmp_path):
    db_file = tmp_path / 'e2e.db'
    os.environ['DATABASE_URL'] = f"sqlite:///{db_file}"
    os.environ['INTERNAL_API_KEY'] = 'e2e-key'
    os.environ['API_KEY'] = 'e2e-external-key'
    os.environ['FLASK_ENV'] = 'test'

    app = create_app()
    app.config['TESTING'] = True

    with app.app_context():
        db.drop_all()
        db.create_all()

    server = _ServerThread(app)
    server.start()
    time.sleep(0.1)

    base = 'http://127.0.0.1:5055'
    headers = {'X-Internal-API-Key': 'e2e-key'}

    try:
        op = requests.post(f'{base}/api/v1/operations/', headers=headers, json={'title': 'E2E Lage'}, timeout=5)
        assert op.status_code == 201
        op_id = op.json()['id']

        veh = requests.post(
            f'{base}/api/v1/vehicles/',
            headers=headers,
            json={'callsign': 'E2E-1', 'vehicle_type': 'HLF', 'crew_count': 4},
            timeout=5
        )
        assert veh.status_code == 201
        veh_id = veh.json()['id']

        assignment = requests.post(
            f'{base}/api/v1/assignments/',
            headers=headers,
            json={'operation_id': op_id, 'title': 'E2E Auftrag'},
            timeout=5
        )
        assert assignment.status_code == 201
        assignment_id = assignment.json()['id']

        link = requests.post(
            f'{base}/api/v1/assignments/{assignment_id}/vehicles',
            headers=headers,
            json={'vehicle_id': veh_id},
            timeout=5
        )
        assert link.status_code == 200

        complete = requests.post(
            f'{base}/api/v1/assignments/{assignment_id}/complete',
            headers=headers,
            timeout=5
        )
        assert complete.status_code == 200
        assert complete.json()['status'] == 'completed'

        close = requests.post(f'{base}/api/v1/operations/{op_id}/close', headers=headers, timeout=5)
        assert close.status_code == 200
        assert close.json()['status'] == 'closed'
    finally:
        server.shutdown()
