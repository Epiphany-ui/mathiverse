FROM manimcommunity/manim:v0.21.0

# The base image's /opt/venv is owned by its non-root user, so pip must
# run as root to install into it.  After installation the container drops
# to the non-root "manimuser" so a compromised renderer has no root rights.
USER root
RUN pip install --no-cache-dir --retries 5 --timeout 60 fastapi uvicorn \
    && python -c "import uvicorn; print('uvicorn OK')"

WORKDIR /app
COPY server.py core.py requirements.txt ./
RUN useradd -m -s /bin/bash renderer \
    && mkdir -p /tmp/mathiverse-renderer /tmp/mathiverse-renderer-staging \
    && chown -R renderer:renderer /tmp/mathiverse-renderer /tmp/mathiverse-renderer-staging /app

# The renderer executes user code: run as the unprivileged user.  Listening
# on all interfaces is fine only because the container network is the trust
# boundary (set explicitly here because the server defaults to loopback).
USER renderer
ENV RENDER_HOST=0.0.0.0

EXPOSE 9876
CMD python -m uvicorn server:app --host 0.0.0.0 --port ${PORT:-9876}
