module ScrumReportHelper

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

  def no_te_html_hours(text)
    text.gsub(%r{(\d+)\.(\d+)}, '<span class="hours hours-int no-time-entry">\1</span><span class="hours hours-dec no-time-entry">.\2</span>').html_safe
  end

  def format_hours_helper(hours, has_time_entry)
    if has_time_entry
      html_hours("%.2f" % hours)
    else
      no_te_html_hours("%.2f" % hours)
    end
  end

end
