FROM nginx:alpine

# Install Python and pip
RUN apk add --no-cache python3 py3-pip

# Copy static files to nginx
COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy Flask backend
COPY app.py /app/app.py
WORKDIR /app

# Install Flask
RUN pip3 install Flask

# Start NGINX and Flask together
CMD sh -c "nginx && python3 app.py"

