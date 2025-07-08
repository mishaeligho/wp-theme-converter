FROM nginx:alpine

# Install required packages
RUN apk add --no-cache python3 py3-pip supervisor

# Install Python deps
COPY requirements.txt /app/requirements.txt
RUN pip3 install -r /app/requirements.txt

# Copy your Flask app and static files
COPY . /app
WORKDIR /app

# Copy nginx and supervisor configs
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose port 80 (nginx)
EXPOSE 80

# Start both nginx and Flask
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
