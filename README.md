redmine_scrum
=============

Our Redmine Scrum plugin
Currentrly only redmine ~> 1.4 supported.

# Migrate
RAILS_ENV=production rake db:migrate:plugins

# Rollback Migrations
RAILS_ENV=production rake db:migrate:plugin NAME=scrum_report VERSION=0
