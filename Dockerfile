FROM nginx:alpine

# Install Python 3 and pip
RUN apk add --no-cache python3 py3-pip

# Copy static files
COPY index.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY images /usr/share/nginx/html/images
COPY nginx.conf /etc/nginx/nginx.conf


# Copy Flask backend
COPY server.py /app/server.py
WORKDIR /app

# Create and activate virtualenv, install Flask
RUN python3 -m venv /app/venv && \
    . /app/venv/bin/activate && \
    pip install Flask flask-cors stripe


# Run NGINX and Flask together
CMD sh -c "nginx && /app/venv/bin/python server.py"

