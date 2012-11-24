class ScrumReportController < ApplicationController
  unloadable

  before_filter :find_project
  before_filter :find_version

  def index
    @free_period = false
    @from, @to = nil, nil
    if @version
      @from = @version.try(:sprint_start_date) || @version.try(:created_on)
      @to = @version.effective_date
    end

    @report = SR::ScrumReporter.new(@project, @version, @from, @to)

    @issues = Issue.where(:project_id => @project.id).
        where("issues.estimated_hours IS NOT NULL").
        joins("LEFT JOIN time_entries ON (time_entries.issue_id = issues.id)").
        select("issues.*, sum(time_entries.hours) AS spent_time").
        group('issues.id').order('issues.parent_id DESC, issues.id ASC')

    @issues = @issues.where(:fixed_version_id => @version.id) if @version
    # @columns = %w(version id status tracker title)

    respond_to do |format|
      format.html { render :layout => !request.xhr? }
      # format.csv  { send_data(report_to_csv(@report), :type => 'text/csv; header=present', :filename => 'timelog.csv') }
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
