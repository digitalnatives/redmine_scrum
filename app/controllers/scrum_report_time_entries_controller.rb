class ScrumReportTimeEntriesController < ApplicationController
  unloadable

  def update
    @time_entry = TimeEntry.find(params[:id])
    params[:time_entry].delete(:activity_id) if params[:time_entry][:activity_id].blank?
    params[:time_entry].delete(:issue_id)

    if @time_entry.update_attributes(params[:time_entry])
      #update_issue(@time_entry.issue)
      render :json => @time_entry
    else
      render :json => {
        :errors => @time_entry.errors,
      }, :status => :unprocessable_entity
    end
  end

  def create
    @time_entry = TimeEntry.new(params[:time_entry])
    @time_entry.user = @time_entry.issue.assigned_to 

    if @time_entry.save
      #update_issue(@time_entry.issue)
      render :json => @time_entry
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
      if params["te_remaining_hours"].present? 
        if @time_enty.te_remaining_hours != issue.remaining_hours && issue.time_entries.sort_by{ |te| te.spent_on }.last == @time_entry
          issue.journalized_update_attribute(:remaining_hours, @time_enty.te_remaining_hours)
        end
      end
    end
  end

end
