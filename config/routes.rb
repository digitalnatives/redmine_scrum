# Plugin's routes
# See: http://guides.rubyonrails.org/routing.html

RedmineApp::Application.routes.draw do
  get  '/scrum_report/:project_id' => 'scrum_report#index'
  get  '/scrum_report_time_entries/:time_entry' => 'scrum_report_time_entries#show'
  put  '/scrum_report_time_entries/:time_entry' => 'scrum_report_time_entries#update'
  post '/scrum_report_time_entries'             => 'scrum_report_time_entries#create'
end
