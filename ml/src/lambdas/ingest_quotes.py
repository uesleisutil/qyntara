import json
import os
from datetime import UTC, datetime

import boto3

s3 = boto3.client("s3")

BUCKET = os.environ["BUCKET"]


def handler(event, context):
    # TODO: aqui você coloca a lógica real (BRAPI + universe etc)
    # Por enquanto, só escreve um "heartbeat" pra provar que tá rodando.
    now = datetime.now(UTC)
    key = f"raw/quotes_5m/heartbeat_{now.strftime('%Y%m%dT%H%M%SZ')}.json"

    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=json.dumps(
            {"ok": True, "ts": now.isoformat(), "event": event}, ensure_ascii=False
        ).encode("utf-8"),
        ContentType="application/json",
    )

    return {"ok": True, "bucket": BUCKET, "key": key}
