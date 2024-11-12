FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

RUN apt-get update && apt-get install -y ruby-full
RUN npm install n -g && n stable && apt purge -y nodejs npm
RUN npm install yarn -g
RUN gem install bundler

RUN mkdir -m777 /workspaces

CMD ["tail","-f","/dev/null"]
