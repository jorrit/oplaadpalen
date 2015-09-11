# Work In Progress

FROM ubuntu:trusty
MAINTAINER Jorrit Schippers <jorrit@ncode.nl>

RUN apt-get update && \
    apt-get install \
# -y --force-yes \
      curl \
      apt-transport-https \
      lsb-release \
      build-essential \
      python-all

RUN curl -sL https://deb.nodesource.com/setup_4.x | bash -
RUN apt-get update
RUN apt-get install nodejs -y --force-yes

COPY . /src
RUN cd /src; npm install

EXPOSE  3000

CMD ["node_modules/.bin/babel-node", "/src/bin/getstatus.js"]
