class ScrumReportController < ApplicationController
  unloadable

  before_filter :find_project
  before_filter :find_version

  def index
    @free_period = false
    @from, @to = nil, nil

    #@report = SR::ScrumReporter.new(@project, @version, @from, @to)

    @issues = Issue.select("issues.id, 
                           issues.parent_id,issues.status_id, 
                           issues.subject, 
                           issues.remaining_hours, 
                           issues.estimated_hours, 
                           sum(time_entries.hours) AS spent_time,
                           min(time_entries.spent_on) AS first_time_entry,
                           max(time_entries.spent_on) AS last_time_entry").
        joins("LEFT JOIN time_entries ON (time_entries.issue_id = issues.id)").
        includes(:status).
        where(:project_id => @project.id).
        where(:tracker_id => RbTask.tracker).
        where("issues.estimated_hours IS NOT NULL").
        group('issues.id').
        order('issues.parent_id DESC, issues.id ASC')

    if @version
      @from = @version.try(:sprint_start_date) || @version.try(:created_on)
      @to = @version.effective_date
      @issues = @issues.where(:time_entries => { :spent_on => @from..@to }) if @from && @to
      @issues = @issues.where(:fixed_version_id => @version.id)
    else
      @from = @issues.map(&:first_time_entry).compact.min
      @to = @issues.map(&:last_time_entry).compact.max
    end


    @days = (@from..@to)

    respond_to do |format|
      format.html { render :layout => !request.xhr? }
      format.csv { render :type => 'text/csv; header=present', :filename => 'scrum_report.csv' }
    end
  end

  private

  def find_project
    @project = Project.includes(:versions).find_by_identifier(params[:project_id])
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
