FROM apache/airflow:2.7.0-python3.11

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  build-essential \
  python3-dev \
  libpq-dev \
  git \
  curl \
  && apt-get autoremove -yqq --purge \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

USER airflow

WORKDIR /opt/airflow

COPY --chown=airflow:root infra/airflow/requirements.txt ./
COPY --chown=airflow:root src ./src

RUN pip install --no-cache-dir -r requirements.txt