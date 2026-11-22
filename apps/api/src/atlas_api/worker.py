from celery import Celery

from atlas_api.settings import settings

app = Celery("atlas", broker=settings.redis_url, backend=settings.redis_url)


@app.task
def ping() -> str:
    return "pong"
