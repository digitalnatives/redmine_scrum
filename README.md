# Redmine Scrum Plugin

Redmine Scrum is a plugin to display sprint spent and remaining hours in a table and on a burndown chart.

With the plugin you can:

* Easily access scrum report from project menu.
* Log spent/remaining hours for multiple tasks from one place.
* Visualize your burndown chart based on spent/remaing hours.
* Designed for daily standup.

The plugin has a few assumption and constraints:

* An issue should have only one assignee.
* Only one time entry can be edited from the table per issue per day.

# Dependency

The plugin depends on [REDMINE BACKLOGS](http://www.redminebacklogs.net) plugin

# Get the plugin

Get the latest source from [GitHub](https://github.com/digitalnatives/redmine_scrum).

# Compatibility

This version of the plugin is compatible with Redmine 1.4 .

# Installation

Follow the Redmine [plugin installation steps](http://www.redmine.org/wiki/redmine/Plugins).

Install the plugin in vendor/plugins/redmine_scrum
```
git clone https://github.com/digitalnatives/redmine_scrum.git
```
Restart your Redmine web servers (e.g. mongrel, thin, mod_rails)

Run the migration
```ruby
RAILS_ENV=production rake db:migrate:plugins
```

# Authors

The plugin was written by developers of [Digital Natives](http://www.digitalnatives.hu/english) team. It is free software, and may be redistributed under the terms specified in the MIT-LICENSE file.

# Licence

This plugin is released under the MIT license.
