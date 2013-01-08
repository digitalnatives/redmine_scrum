#' Plugin's routes
# See: http://guides.rubyonrails.org/routing.html

if Rails::VERSION::MAJOR < 3

  ActionController::Routing::Routes.draw do |map|
    map.connect  '/scrum_report/:project_id', :controller => 'scrum_report', :action => 'index' 
    map.resources :scrum_report_time_entries, :collection => { :update_issue_status => :post }
    # get  '/scrum_report_time_entries/:time_entry' => 'scrum_report_time_entries#show'
    # put  '/scrum_report_time_entries/:time_entry' => 'scrum_report_time_entries#update'
    # post '/scrum_report_time_entries'             => 'scrum_report_time_entries#create'
  end

else

  RedmineApp::Application.routes.draw do
    get  '/scrum_report/:project_id' => 'scrum_report#index'
    get  '/scrum_report_time_entries/:time_entry' => 'scrum_report_time_entries#show'
    put  '/scrum_report_time_entries/:time_entry' => 'scrum_report_time_entries#update'
    post '/scrum_report_time_entries'             => 'scrum_report_time_entries#create'
  end

end
