FROM nginx:alpine

# Install dependencies
RUN apk add --no-cache python3 py3-pip supervisor

# Install Python packages
RUN pip3 install virtualenv

# Set up Flask app directory
WORKDIR /app
COPY server.py /app/server.py
RUN python3 -m venv venv && \
    ./venv/bin/pip install Flask flask-cors stripe

# Copy static files for NGINX
COPY index.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY images /usr/share/nginx/html/images
COPY nginx.conf /etc/nginx/nginx.conf

# Copy Supervisor config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose NGINX port
EXPOSE 80

# Start both services
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
