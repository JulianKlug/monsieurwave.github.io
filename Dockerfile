# Base image: Ruby with necessary dependencies for Jekyll
FROM ruby:3.2

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    nodejs \
    cron \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy Gemfile and lock into the container (necessary for `bundle install`;
# the lock pins the gem versions the mounted repo expects)
COPY Gemfile Gemfile.lock ./

# Install bundler and dependencies
RUN gem install bundler:2.3.26 && bundle install

# Daily 04:00 refresh of the research map's publication list from ORCID.
# Writes academic_map/data/works.json in the mounted repo; --watch rebuilds the site.
# A failed fetch raises before writing, so the previous list survives.
RUN echo "0 4 * * * root cd /usr/src/app && /usr/bin/python3 academic_map/scripts/fetch_orcid.py >> /var/log/orcid.log 2>&1" > /etc/cron.d/orcid \
    && chmod 0644 /etc/cron.d/orcid

# Expose port 4000 for Jekyll server
EXPOSE 4000

# Start cron in the background, then serve the Jekyll site
CMD ["sh", "-c", "cron && exec bundle exec jekyll serve --host 0.0.0.0 --watch"]

