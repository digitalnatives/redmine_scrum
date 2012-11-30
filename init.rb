if Rails::VERSION::MAJOR < 3
  require 'dispatcher'
  Dispatcher
else
  Rails.configuration
end.to_prepare do
  require_dependency 'sr_time_entry_patch'
  require_dependency 'sr_scrum_reporter'
  require_dependency 'redmine_scrum_hooks'
end

Redmine::Plugin.register :scrum_report do
  name 'Scrum Report plugin'
  author 'Author name'
  description 'This is a plugin for Redmine'
  version '0.0.1'
  url 'http://example.com/path/to/plugin'
  author_url 'http://example.com/about'

  menu(:project_menu, :scrum_report, {:controller => "scrum_report", :action => 'index'}, :caption => 'Scrum Hours', :after => :my_page, :if => Proc.new{ User.current.logged? }, :param => :user_id)
  permission :access_scrum_report, :scrum_report => :index
end
