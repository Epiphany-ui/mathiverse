FROM manimcommunity/manim:v0.19.0

# Install FastAPI + uvicorn
RUN pip install fastapi uvicorn

WORKDIR /app
COPY server.py core.py requirements.txt ./

EXPOSE 9876

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "9876"]
