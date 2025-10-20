from fastapi import FastAPI
import logging
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

logging.basicConfig(level=os.getenv("LOG_LEVEL") | logging.INFO)

@app.get('/health', status_code=200)
async def main():
    return {'message': 'the application is healthy'}