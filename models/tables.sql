CREATE TABLE stops (
    RecordedAtTime TIMESTAMPTZ NOT NULL,
    PublishedLineName TEXT NOT NULL,
    DestinationName TEXT NOT NULL,
    DirectionRef TEXT NOT NULL,
    StopPointName TEXT NOT NULL,
    StopPointRef TEXT NOT NULL,
    VehicleRef TEXT NOT NULL
)
SELECT create_hypertable('stops', 'RecordedAtTime');

CREATE TABLE positions (
    time TIMESTAMPTZ NOT NULL,
    destination TEXT NOT NULL,
    buses json[]
);
SELECT create_hypertable('positions', 'time');
