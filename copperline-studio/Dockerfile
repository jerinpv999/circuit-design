#
# Copperline Studio — production image
# Stage 1 runs the engine tests and bundles the JavaScript libraries locally,
# so the running container needs no CDN access (Google Fonts falls back to system fonts offline).
# Stage 2 serves the static site with nginx.

FROM node:20-alpine AS build
WORKDIR /app

# Pinned library versions (same as the CDN URLs in index.html)
RUN npm init -y >/dev/null \
 && npm install --no-audit --no-fund --loglevel=error \
      react@18.3.1 react-dom@18.3.1 htm@3.1.1 three@0.128.0 jszip@3.10.1

COPY index.html ./
COPY src ./src
COPY tests ./tests

# Fail the build if the engine tests fail
RUN node tests/run-tests.js

# Assemble the site and point the <script> tags at the local copies
RUN mkdir -p dist/vendor \
 && cp -r index.html src dist/ \
 && cp node_modules/react/umd/react.production.min.js \
       node_modules/react-dom/umd/react-dom.production.min.js \
       node_modules/htm/dist/htm.umd.js \
       node_modules/three/build/three.min.js \
       node_modules/jszip/dist/jszip.min.js \
       dist/vendor/ \
 && sed -i -E '/<script src="https:/ s#src="https://[^"]*/([^/"]+\.js)"#src="vendor/\1"#' dist/index.html \
 && ! grep -q '<script src="https' dist/index.html

FROM nginx:1.27-alpine
LABEL org.opencontainers.image.title="Copperline Studio" \
      org.opencontainers.image.description="Browser EDA: schematic, simulation, MCU firmware, PCB layout, 3D and Gerber export"
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
