#' Plugin's routes
# See: http://guides.rubyonrails.org/routing.html

if Rails::VERSION::MAJOR < 3

  ActionController::Routing::Routes.draw do |map|
    map.connect  '/scrum_report/:project_id', :controller => 'scrum_report', :action => 'index' 
    map.resources :scrum_report_time_entries
  end

else

  RedmineApp::Application.routes.draw do
    resources :scrum_report_time_entries
    get  '/scrum_report/:project_id' => 'scrum_report#index'
  end

end
