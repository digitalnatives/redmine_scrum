# Plugin's routes
# See: http://guides.rubyonrails.org/routing.html

RedmineApp::Application.routes.draw do
  get '/scrum_report/:project_id' => 'scrum_report#index'
end