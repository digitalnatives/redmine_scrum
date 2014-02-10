module RS
  class ScrumReporter
    attr_reader :data

    def initialize(project, version)
      @project = project
      @version = version

      run_query
      set_up_day_range
      set_data_matrix
      set_ideal_line
    end

    private

    def set_data_matrix
      @bugs_story_id = 0
      @data = {}
      @data[:ideal_line] = []
      @data[:remain_line] = []
      @data[:issue_ids] = []
      @data[:days] = @days.map(&:to_s)
      @data[:rows] = []
      @parents = []
      @issues.each do |issue|
        if issue.parent_id.present? && !@parents.include?(issue.parent_id)
          @parent = Issue.find(issue.parent_id)
          set_story_row
        end

        if issue.parent_id.blank? && !@parents.include?(@bugs_story_id) && issue.tracker_id == Setting.plugin_redmine_scrum['bug_tracker'].to_i
          set_bugs_story_row
        end

        next if issue.parent_id.blank? && issue.tracker_id == RbTask.tracker

        row = {
          :issue_id => issue.id,
          :is_story => false,
          :subject => issue.subject,
          :assignee_id => issue.assigned_to_id,
          :assignee_name => "#{issue.assigned_to}",
          :estimated => issue.estimated_hours,
          :subject => issue.subject,
          :status => "#{issue.status}",
          :status_id => issue.status_id,
          :category_id => (issue.category_id || @parent.try(:category_id)),
          :statuses => issue.new_statuses_allowed_to.map { |i| { :id => i.id, :name => i.name } }
        }
        row[:cells] = set_cells(issue)

        @data[:rows] << row
      end
      @data[:assignees] = @project.assignable_users.map{ |u| { :name => u.to_s, :id => u.id } }
      @data[:categories] = @project.issue_categories.map{ |c| { :name => c.name, :id => c.id } }
      @data[:issue_statuses] = IssueStatus.all.map{ |s| { :name => s.to_s, :id => s.id } }
      @data[:sum_estimated_hours] = @sum_estimated_hours
      @days.each_with_index do |day, idx|
        @data[:sprint_start] = idx if day == @sprint_start
        @data[:sprint_end] = idx if day == @sprint_end
      end
    end

    def set_story_row
      parent_row = {}
      parent_row[:is_story] = true
      parent_row[:story_id] = @parent.id
      parent_row[:assignee] = "#{@parent.assigned_to}"
      parent_row[:story_subject] = @parent.subject
      parent_row[:estimated] = @parent.estimated_hours
      parent_row[:status] = "#{@parent.status}"
      parent_row[:category] = "#{@parent.category}"
      parent_row[:cells] = []
      @days.each_with_index do |day, idx|
        parent_row[:cells] << {
          :day => day.to_s,
          :issue_id => @parent.id
        }
      end

      # A story -t is hozzá adjuk az issues tömbhöz
      @data[:rows] << parent_row
      @parents << @parent.id
    end

    def set_bugs_story_row
      parent_row = {}
      parent_row[:is_story] = true
      parent_row[:story_id] = @bugs_story_id
      parent_row[:assignee] = "Bug Fixer"
      parent_row[:story_subject] =  "Bugs"
      parent_row[:estimated] = 0
      parent_row[:status] = "Status"
      parent_row[:category] = "Bug"
      parent_row[:cells] = []
      @days.each_with_index do |day, idx|
        parent_row[:cells] << {
          :day => day.to_s,
          :issue_id => @bugs_story_id
        }
      end
      @data[:rows] << parent_row
      @parents << @bugs_story_id
    end

    def set_cells(issue)
      cells = []
      @days.each_with_index do |day, idx|
        cell = {}

        issue_entries = issue.time_entries.select{ |te| te.spent_on == day }.sort_by(&:updated_on)
        # Important! If assigned to user has time entry on given day that is what we display in table since he/she responsible for the task
        entry = issue_entries.select{ |te| te.user_id == issue.assigned_to_id}.last
        entry = issue_entries.last unless entry
        if entry.try(:te_remaining_hours).present?
          issue.left_hours = entry.te_remaining_hours.to_f
        end

        cell[:issue_id] = issue.id
        cell[:left] = issue.left_hours.to_f
        cell[:spent] = issue_entries.compact.sum(&:hours)
        cell[:time_entry_count] = issue_entries.size || 0
        cell[:assignee_te] = issue_entries.find{ |te| te.user_id == issue.assigned_to_id }
        cell[:assignee_id] = issue.assigned_to_id
        cell[:story_id] = issue.parent_id || @bugs_story_id
        cell[:subject] = issue.subject
        cell[:day] = day.to_s
        cells << cell
      end
      cells
    end

    def set_ideal_line
      @days.each_with_index do |day, idx|
        @data[:ideal_line] << [ day.to_s, 0 ]
        @data[:remain_line] << [ day.to_s, 0 ]
      end
    end

    def run_query
      default_conditions
      if @version
        @conditions += " AND issues.fixed_version_id = :version_id"
        @condition_vars.merge!({
          :version_id => @version.id
        })
      end
      @issues = Issue.all(:select => "issues.id,
                           issues.parent_id,
                           issues.status_id,
                           issues.category_id,
                           issues.tracker_id,
                           issues.subject,
                           parents.subject AS parent_subject,
                           parents.estimated_hours AS parent_estimated_hours,
                           COALESCE(issues.remaining_hours, 0) AS remaining_hours,
                           COALESCE(issues.estimated_hours, 0) AS estimated_hours,
                           COALESCE(issues.estimated_hours, 0) AS left_hours,
                           issues.assigned_to_id,
                           sum(time_entries.hours) AS spent_time,
                           min(time_entries.spent_on) AS first_time_entry,
                           max(time_entries.spent_on) AS last_time_entry",
                           :joins => "LEFT JOIN issues parents ON issues.parent_id = parents.id
                           LEFT JOIN time_entries ON (time_entries.issue_id = issues.id)",# LEFT JOIN versions ON issues.fixed_version_id = versions.id",
                           :include => [ :status, :assigned_to, :tracker, :category ],
                           :conditions => [ @conditions, @condition_vars ],
                           :group => 'issues.id',
                           :order => 'parents.position ASC, issues.parent_id ASC, issues.position ASC')
      @sum_estimated_hours = @issues.sum(&:estimated_hours)
      @sum_spent_hours = @issues.map(&:spent_time).compact.map(&:to_f).sum
    end

    def default_conditions
      @conditions = "issues.project_id = :project_id
                  AND issues.tracker_id IN (:tracker_id)"
                  #AND versions.status != 'closed'"
      @condition_vars = {
        :project_id => @project.id,
        :tracker_id => [ RbTask.tracker, Setting.plugin_redmine_scrum['bug_tracker'].to_i ]
      }
    end

    def set_up_day_range
      @sprint_start = @version.try(:sprint_start_date) || Date.today
      @sprint_end = @version.try(:effective_date) || Date.today

      days = (@sprint_start..@sprint_end).to_a
      days = days + days_with_hours
      days = days.uniq.sort

      # Use the Secretary lib from RedmineMultiCalendar if enabled
      @days = if Setting.plugin_redmine_scrum['use_secretary']
                  begin
                  (Secretary.ask(:interval,
                                 days.first,
                                 days.last,
                                 :day_type => Setting.plugin_redmine_scrum['workday_name']).
                            keys.map(&:to_date).sort | days_with_hours).sort
                  rescue
                    days
                  end
              else
                days
              end

      # Cleanup secretary returned days which out of sprint intervall and has no time entry logged.
      @days.reject!{ |day| day if (day < @sprint_start || @sprint_end < day) && !days.include?(day) }
    end

    def days_with_hours
      @days_with_hours ||= TimeEntry.select("spent_on, hours").where(:issue_id => @issues.map(&:id)).map do |te|
        te.spent_on if te.hours > 0
      end
    end

  end
end
