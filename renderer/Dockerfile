FROM manimcommunity/manim:v0.19.0

# Install FastAPI + uvicorn
RUN pip install --no-cache-dir fastapi uvicorn && python -c "import uvicorn; print('uvicorn OK')"

WORKDIR /app
COPY server.py core.py requirements.txt ./

EXPOSE 9876
CMD python -m uvicorn server:app --host 0.0.0.0 --port ${PORT:-9876}
