class ScrumReportController < ApplicationController
  unloadable

  before_filter :find_project, :authorize, :only => [ :index ]
  before_filter :find_version

  def index
      if Redmine::Plugin.method_defined?(:mirror_assets)
      Redmine::Plugin.mirror_assets(:redmine_scrum)
    else
      FileUtils.cp('/home/boni/public_html/redmine-1.4/vendor/plugins/redmine_scrum/assets/javascripts/time_entry.js','/home/boni/public_html/redmine-1.4/public/plugin_assets/redmine_scrum/javascripts/')
    end

    @report = RS::ScrumReporter.new(@project, @version)
    respond_to do |format|
      format.html { render :layout => !request.xhr? }
      format.csv { render :type => 'text/csv; header=present', :filename => 'scrum_report.csv' }
    end
  end


  private

  def find_project
    # @project = Project.includes(:versions).find_by_identifier(params[:project_id])
    @project = Project.find_by_identifier(params[:project_id])
    @versions = @project.versions
  rescue ActiveRecord::RecordNotFound
    render_404
  end

  def find_version
    @version = @project.versions.find(params[:version_id]) if params[:version_id].present?
  rescue ActiveRecord::RecordNotFound
    render_404
  end


end
