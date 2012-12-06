class ScrumReportTimeEntriesController < ApplicationController
  unloadable

  before_filter :backlogs_hack

  def update
    @time_entry = TimeEntry.find(params[:id])
    params[:time_entry].delete(:activity_id) if params[:time_entry][:activity_id].blank?
    params[:time_entry].delete(:issue_id)

    if @time_entry.editable_by?(User.current) && @time_entry.update_attributes(params[:time_entry])
      update_issue(@time_entry.issue)
      render :json => {
        :entry => @time_entry.to_json(:only => [:id]),
        :issue_remain_hours => @time_entry.issue.instance_eval{ remaining_hours },
        :last => @last 
      }
    else
      render :json => {
        :errors => @time_entry.errors,
      }, :status => :unprocessable_entity
    end
  end

  def create
    @time_entry = TimeEntry.new(params[:time_entry])
    @time_entry.user = @time_entry.issue.assigned_to 
    @time_entry.project = @time_entry.issue.project

    if @time_entry.editable_by?(User.current) && @time_entry.save
      update_issue(@time_entry.issue)
      render :json => {
        :entry => @time_entry.to_json(:only => [:id]),
        :issue_remain_hours => @time_entry.issue.instance_eval{ remaining_hours },
        :last => @last
      }
    else
      render :json => {
        :errors => @time_entry.errors,
      }, :status => :unprocessable_entity
    end
  end

  def show
    @time_entry = TimeEntry.find(params[:time_entry])
    render :json => {
      :time_entry => @time_entry.as_json(:hours, :te_remaining_hours)
    }
  end

  private

  def update_issue(issue)

    if issue.is_task? && User.current.allowed_to?(:te_remaining_hours, @time_entry.project) != nil
      if @time_entry.te_remaining_hours != issue.instance_eval{ remaining_hours } && issue.time_entries.sort_by{ |te| te.spent_on }.last == @time_entry
        issue.journalized_update_attribute(:remaining_hours, @time_entry.te_remaining_hours)
        @last = true
      end
    end
  end

  def backlogs_hack
    ScrumReportTimeEntriesController.send :undef_method, :remaining_hours
    while ScrumReportTimeEntriesController.included_modules.include?(RbCommonHelper) do
      ScrumReportTimeEntriesController.send(:remove_const, :RbCommonHelper) 
    end
  end
end
