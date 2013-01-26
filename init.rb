if Rails::VERSION::MAJOR < 3
  require 'dispatcher'
  Dispatcher
else
  Rails.configuration
end.to_prepare do
  require_dependency 'rs_scrum_reporter'
  require_dependency 'redmine_scrum_hooks'
end

Redmine::Plugin.register :redmine_scrum do
  name 'Redmine Scrum Report plugin'
  author 'Digital Natives'
  description 'Scrum plugin to display burndown chart based on estimated and remaining hours'
  version '0.2.1'
  url 'https://github.com/digitalnatives/redmine_scrum'
  author_url 'http://digitalnatives.hu'
  requires_redmine_plugin :redmine_backlogs, :version_or_higher => '0.9.26'

  project_module :backlogs do
    permission :access_scrum_report, :scrum_report => :index
  end

  menu(:project_menu, :scrum_report, {:controller => "scrum_report", :action => 'index'}, :caption => 'Scrum Report', :before => :settings, :if => Proc.new{ User.current.logged? && Backlogs.configured? }, :param => :project_id)
end
