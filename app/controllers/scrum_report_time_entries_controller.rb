class ScrumReportTimeEntriesController < ApplicationController
  unloadable

  def update
    @time_entry = TimeEntry.find(params[:id])
    params[:time_entry].delete(:activity_id) if params[:time_entry][:activity_id].blank?
    params[:time_entry].delete(:issue_id)

    if @time_entry.editable_by?(User.current) && @time_entry.update_attributes(params[:time_entry])
      update_issue(@time_entry.issue)
      render :json => {
        :te_id => @time_entry.id,
        :issue_remain_hours => @time_entry.issue.attributes["remaining_hours"],
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
      prev_remain_hours = @time_entry.issue.attributes["remaining_hours"]
      update_issue(@time_entry.issue)
      render :json => {
        :te_id => @time_entry.id,
        :issue_remain_hours => @time_entry.issue.attributes["remaining_hours"],
        :prev_remain_hours => prev_remain_hours,
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

  def update_issue_assignee
  end

  def update_issue_status
    @issue = Issue.find(params[:issue_id])
    update_allowed = User.current.allowed_to?(:edit_issues, @issue.project)
    allowed_statuses = @issue.new_statuses_allowed_to(User.current)
    status = IssueStatus.find(params[:status_id])
    if update_allowed && allowed_statuses.include?(status)
      @issue.status = status
      @issue.save
      head 200
    else
      render :json => {
        :errors => @issue.errors,
      }, :status => :unprocessable_entity
    end
  end

  private

  def update_issue(issue)
    if issue.is_task? && User.current.allowed_to?(:te_remaining_hours, @time_entry.project) != nil
      if @time_entry.te_remaining_hours != issue.attributes["remaining_hours"] && issue.time_entries.sort_by{ |te| te.spent_on }.last == @time_entry
        issue.journalized_update_attribute(:remaining_hours, @time_entry.te_remaining_hours)
        @last = true
      end
    end
  end

end
