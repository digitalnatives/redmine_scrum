class ScrumReportTimeEntriesController < ApplicationController
  unloadable

  def update
    @time_entry = TimeEntry.find(params[:id])
    params[:time_entry].delete(:activity_id) if params[:time_entry][:activity_id].blank?
    params[:time_entry].delete(:issue_id)

    if @time_entry.editable_by?(User.current) && @time_entry.update_attributes(params[:time_entry])
      set_time_entry_user
      render :json => cell_values
    else
      render :json => {
        :errors => @time_entry.errors,
      }, :status => :unprocessable_entity
    end
  end

  def create
    user = User.find(params[:time_entry][:user_id])
    @time_entry = TimeEntry.new(params[:time_entry].merge(:user => user))
    @time_entry.project = @time_entry.issue.project

    if @time_entry.editable_by?(User.current) && @time_entry.save
      set_time_entry_user
      render :json => cell_values
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
      :issueId => te.issue_id,
      :day => te.spent_on,
      :spent => te.hours,
      :left => te.te_remaining_hours,
      :activityId => te.activity_id,
      :activity => te.activity.to_s,
      :userId => te.user_id,
      :userName => te.user.to_s
    }
    end
    render :json => { :entries => @entries.to_json }
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

  def cell_values
    spent = 0
    left = nil 
    assignee_present = false
    @time_entry.issue.time_entries.sort_by(&:updated_on).each do |te| 
      next unless te.spent_on == @time_entry.spent_on
      spent += te.hours
      assignee_present = true if @time_entry.issue.assigned_to_id == te.user_id
      next if assignee_present && @time_entry.issue.assigned_to_id != te.user_id
      left = te.te_remaining_hours 
    end
    { 
      :id => @time_entry.id,
      :cellSpent => spent,
      :cellLeft => left,
      :spent => @time_entry.hours,
      :left => @time_entry.te_remaining_hours,
      :activityId => @time_entry.activity_id,
      :activity => @time_entry.activity.to_s,
      :userId => @time_entry.user_id,
      :userName => @time_entry.user.to_s
    }
  end

  def set_time_entry_user
    #TODO: SET Authorization rules!!!
    if params[:time_entry][:user_id].present? && @time_entry.user_id != params[:time_entry][:user_id]
      @time_entry.update_attribute(:user_id, params[:time_entry][:user_id])
      @time_entry.user.reload
      #update_issue(@time_entry.issue)
    end
  end

end
