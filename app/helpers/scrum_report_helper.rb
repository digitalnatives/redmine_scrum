module ScrumReportHelper

  def sum_te_remaining_hours(data)
    sum = 0
    data.each do |row|
      sum += row['te_remaining_hours'].to_f
    end
    sum
  end

    # Returns a collection of activities for a select field.  time_entry
  #   # is optional and will be used to check if the selected TimeEntryActivity
  #     # is active.
  def activity_collection_for_select_options(time_entry=nil, project=nil)
    project ||= @project
    if project.nil?
      activities = TimeEntryActivity.shared.active
    else
      activities = project.activities
    end

    collection = []
    if time_entry && time_entry.activity && !time_entry.activity.active?
      collection << [ "--- #{l(:actionview_instancetag_blank_option)} ---", '' ]
    else
      collection << [ "--- #{l(:actionview_instancetag_blank_option)} ---", '' ] unless activities.detect(&:is_default)
    end
    activities.each { |a| collection << [a.name, a.id] }
    collection
  end

end
