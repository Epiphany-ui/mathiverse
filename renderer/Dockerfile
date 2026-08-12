FROM manimcommunity/manim:v0.21.0

# The base image's /opt/venv is owned by its non-root user, so pip must
# run as root to install into it.  The container then runs as root too —
# fine for Render's free tier.
USER root
RUN pip install --no-cache-dir fastapi uvicorn && python -c "import uvicorn; print('uvicorn OK')"

WORKDIR /app
COPY server.py core.py requirements.txt ./

EXPOSE 9876
CMD python -m uvicorn server:app --host 0.0.0.0 --port ${PORT:-9876}
