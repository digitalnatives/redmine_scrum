# Deprecation notice

This repository is not maintained.

# Redmine Scrum Plugin

Redmine Scrum is a plugin to display sprint spent and remaining hours in a table and on a burndown chart.

With the plugin you can:

* Easily access scrum report from project menu.
* Log spent/remaining hours for multiple tasks from one place.
* Visualize your burndown chart based on spent/remaing hours.
* Manage daily standup.

The plugin has a few assumption and constraints:

* An issue should have only one assignee.
* Only one time entry can be edited from the table per issue per day.

## Dependency

The plugin depends on [REDMINE BACKLOGS](http://www.redminebacklogs.net) plugin

## Compatibility

This version of the plugin is compatible with Redmine 1.4

## Installation

Follow the Redmine [plugin installation steps](http://www.redmine.org/wiki/redmine/Plugins).

Install the plugin in vendor/plugins/redmine_scrum
```
git clone https://github.com/digitalnatives/redmine_scrum.git
```
Run the migration
```ruby
RAILS_ENV=production rake db:migrate:plugins
```

Restart your Redmine web servers (e.g. mongrel, thin, mod_rails)

Define roles access to redmine scrum in `Administration -> Roles and permissions`

Within `Backlogs` block check Access scrum report checkbox for each role that needs access.

Authors
-------

<img src="http://m.blog.hu/di/digitalnatives/skins/white_swirl_dina/img/logo.png" width="150"/>

The plugin was written by developers of [Digital Natives](http://www.digitalnatives.hu/english) team. 

Licence
-------

This plugin  is free software, and may be redistributed under the terms specified in the MIT-LICENSE file.

