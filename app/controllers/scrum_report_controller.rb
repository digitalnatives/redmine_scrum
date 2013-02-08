class ScrumReportController < ApplicationController
  unloadable

  before_filter :find_project, :authorize, :only => [ :index ]
  before_filter :find_version
  before_filter :refresh_assets, :if => Proc.new{ Rails.env.development? }

  def index
    @report = RS::ScrumReporter.new(@project, @version)

    respond_to do |format|
      format.html { render :layout => !request.xhr? }
      format.csv { render :type => 'text/csv; header=present', :filename => 'scrum_report.csv' }
    end
  end

  private

  def find_project
    @project = Project.find_by_identifier(params[:project_id])
    @versions = @project.versions
  rescue ActiveRecord::RecordNotFound
    render_404
  end

  def find_version
    if params[:version_id].present?
      @version = @project.versions.find(params[:version_id])
    else
      @version = @project.versions.find(:first, :conditions => [ "sprint_start_date <= ? AND effective_date >= ?", Date.today, Date.today ]) || @project.versions.last
    end
  rescue ActiveRecord::RecordNotFound
    render_404
  end

  def refresh_assets
    if Redmine::Plugin.method_defined?(:mirror_assets)
      Redmine::Plugin.mirror_assets(:redmine_scrum)
    else
      source_md5s = []
      destination_md5s = []
      Dir["#{Rails.root}/vendor/plugins/redmine_scrum/assets/**/*"].each { |file| source_md5s << Digest::MD5::hexdigest(File.read(file)) if File.file?(file) }
      Dir["#{Rails.root}/public/plugin_assets/redmine_scrum/**/*"].each { |file| destination_md5s <<  Digest::MD5::hexdigest(File.read(file)) if File.file?(file) }
      if source_md5s != destination_md5s
        FileUtils.cp_r("#{Rails.root}/vendor/plugins/redmine_scrum/assets/.","#{Rails.root}/public/plugin_assets/redmine_scrum")
      end
    end
  end

end
