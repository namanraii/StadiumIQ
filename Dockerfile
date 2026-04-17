# Use the official Nginx Alpine image
FROM nginx:alpine

# Copy the custom Nginx configuration listening on port 8080
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy all the static assets into Nginx's serving directory
COPY . /usr/share/nginx/html

# Expose port 8080 so Cloud Run can route traffic to it
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
