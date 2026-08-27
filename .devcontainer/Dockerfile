FROM node:20.18.0-bullseye

RUN apt-get update && apt-get install -y git
RUN npm install -g npm@10.9.0

RUN node -v && npm -v

CMD ["sleep", "infinity"]
