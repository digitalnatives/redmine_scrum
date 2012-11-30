class ScrumReportTimeEntriesController < ApplicationController
  unloadable

  def update
    @time_entry = TimeEntry.find(params[:time_entry])
    @time_entry.hours = nil
    if @time_entry.save
      head 200
    else
      render :json => {
        :errors => @time_entry.errors,
      }, :status => :unprocessable_entity
    end
  end

  def create
  end

  def show
    @time_entry = TimeEntry.find(params[:time_entry])
    render :json => {
      :time_entry => @time_entry.as_json(:hours, :te_remaining_hours)
    }
  end

end
