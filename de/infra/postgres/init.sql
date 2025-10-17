SELECT 'CREATE DATABASE airflow'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'airflow')\gexec

SELECT 'CREATE DATABASE olap_hotspot'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'olap_hotspot')\gexec

GRANT ALL PRIVILEGES ON DATABASE airflow TO postgres;
GRANT ALL PRIVILEGES ON DATABASE olap_hotspot TO postgres;