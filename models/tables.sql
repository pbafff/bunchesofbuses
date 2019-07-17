CREATE TABLE trips (
    begin_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NULL,
    trip_id TEXT NOT NULL,
    vehicleref TEXT NOT NULL,
    destination TEXT NOT NULL,
    active BOOLEAN NOT NULL,
    termination_reason TEXT NULL,
    bunch_time NUMERIC NULL
);
SELECT create_hypertable('trips', 'begin_time');

CREATE TABLE stops (
    trip_id TEXT NOT NULL,
    time TIMESTAMPTZ NOT NULL,
    stop TEXT NOT NULL,
    stop_point_ref TEXT NOT NULL
);
SELECT create_hypertable('stops', 'time');

CREATE TABLE bunch_data (
    trip_id TEXT NOT NULL,
    time TIMESTAMPTZ NOT NULL,
    traffic_speed NUMERIC NULL,
    longitude NUMERIC NULL,
    latitude NUMERIC NULL
);
SELECT create_hypertable('bunch_data', 'time');

CREATE TABLE waiting (
    trip_id TEXT NOT NULL,
    time TIMESTAMPTZ NOT NULL,
    value BOOLEAN NOT NULL
);
SELECT create_hypertable('waiting', 'time');