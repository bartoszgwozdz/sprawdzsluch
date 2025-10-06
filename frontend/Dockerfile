# 1. Bazowy obraz nginx
FROM nginx:alpine

# 2. Skopiuj frontend do katalogu serwowanego przez nginx
COPY src /usr/share/nginx/html

# 3. (opcjonalnie) podmień własną konfigurację nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 4. Domyślny port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

