class ScrumReportController < ApplicationController
  unloadable


  before_filter :find_project, :authorize, :only => [ :index ]
  before_filter :find_version

  def index
    if Rails.env.development?
      Redmine::Plugin.method_defined?(:mirror_assets) && Redmine::Plugin.mirror_assets(:redmine_scrum)
    end

=begin
    @issues = Issue.select("issues.id, 
                           issues.parent_id,issues.status_id, 
                           issues.subject, 
                           issues.remaining_hours, 
                           issues.estimated_hours, 
                           issues.assigned_to_id,
                           sum(time_entries.hours) AS spent_time,
                           min(time_entries.spent_on) AS first_time_entry,
                           max(time_entries.spent_on) AS last_time_entry").
        joins("LEFT JOIN time_entries ON (time_entries.issue_id = issues.id)").
        includes(:status, :assigned_to).
        where(:project_id => @project.id).
        # only backlog tasks
        where(:tracker_id => RbTask.tracker).
        where("issues.estimated_hours IS NOT NULL").
        group('issues.id').
        order('issues.parent_id DESC, issues.id ASC')

=end

    @report = SR::ScrumReporter.new(@project, @version)
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
