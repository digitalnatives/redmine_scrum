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
    @entries = []
    issue = Issue.find(params[:id])
    issue.time_entries.each do |te| 
      next unless te.spent_on == Date.parse(params[:day])
      @entries << {
        :id => te.id,
        :spent => te.hours,
        :left => te.te_remaining_hours,
        :activityId => te.activity_id,
        :activity => te.activity.to_s,
        :userId => te.user_id,
        :userName => te.user.to_s
      }
    end
    render :json => {
      :entries => @entries.to_json
    }
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
