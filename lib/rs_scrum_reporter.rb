module RS 
  class ScrumReporter
    attr_reader :data

    def initialize(project, version)
      @project = project
      @version = version

      run
      set_up_day_range
      set_up_day_data
    end

    private

    def set_up_day_data
      @data = {}
      @data[:ideal_line] = []
      @data[:remain_line] = []
      @data[:issue_ids] = []
      @data[:days] = @days.to_a.map(&:to_s)
      @data[:rows] = []
      set_ideal_line
      parents = []
      @issues.each do |issue|
        if issue.parent_id.present? && !parents.include?(issue.parent_id)
          parent_row = {}
          parent = Issue.find(issue.parent_id)
          parent_row[:is_story] = true
          parent_row[:story_id] = parent.id
          parent_row[:assignee] = "#{parent.assigned_to}"
          parent_row[:story_subject] = parent.subject
          parent_row[:estimated] = parent.estimated_hours
          parent_row[:status] = "#{parent.status}"
          parent_row[:cells] = []
          @days.to_a.each_with_index do |day, idx| 
           parent_row[:cells] << {
              :day => day.to_s,
              :issue_id => parent.id
            }
          end

          # A story -t is hozzá adjuk az issues tömbhöz
          @data[:rows] << parent_row
          parents << parent.id
        end

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
          :statuses => issue.new_statuses_allowed_to.map { |i| { :id => i.id, :name => i.name } }
        }
        row[:cells] = set_cells(issue)

        @data[:rows] << row
        @data[:assignees] = @project.assignable_users.map{ |u| { :name => u.to_s, :id => u.id }}
        @data[:issue_statuses] = IssueStatus.all.map{ |s| { :name => s.to_s, :id => s.id } }
        @data[:sum_estimated_hours] = @sum_estimated_hours
      end

    end

    def set_cells(issue)
      cells = []
      @days.to_a.each_with_index do |day, idx|
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
        cell[:story_id] = issue.parent_id
        cell[:subject] = issue.subject
        cell[:day] = day.to_s
        cells << cell
      end
      cells
    end

    def set_ideal_line
      rate = (@days.to_a.size > 1) ? @sum_estimated_hours / (@days.to_a.size - 1) : 0
      @days.to_a.each_with_index do |day, idx|
        @data[:ideal_line] << [ day.to_s, (@sum_estimated_hours - idx * rate) ]
        @data[:remain_line] << [ day.to_s, (@sum_estimated_hours - idx * rate) ]
      end
    end

    def run
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
                           :joins => "INNER JOIN issues parents ON issues.parent_id = parents.id
                           LEFT JOIN time_entries ON (time_entries.issue_id = issues.id)",# LEFT JOIN versions ON issues.fixed_version_id = versions.id",
                           :include => [ :status, :assigned_to, :tracker ],
                           :conditions => [ @conditions, @condition_vars ],
                           :group => 'issues.id',
                           :order => 'parents.position ASC, issues.parent_id ASC, issues.id ASC')
      @sum_estimated_hours = @issues.sum(&:estimated_hours) 
      @sum_spent_hours = @issues.map(&:spent_time).compact.map(&:to_f).sum
    end

    def default_conditions
      @conditions = "issues.project_id = :project_id 
                  AND issues.tracker_id = :tracker_id"
                  #AND versions.status != 'closed'"
      @condition_vars = { 
        :project_id => @project.id,
        :tracker_id => RbTask.tracker
      }
    end

    def set_up_day_range
      first_time_entry = @issues.map(&:first_time_entry).compact.min
      last_time_entry = @issues.map(&:last_time_entry).compact.max
      first_time_entry = Date.parse(first_time_entry) if first_time_entry
      last_time_entry = Date.parse(last_time_entry) if last_time_entry

      from = []
      to = []

      unless @version 
        sprint_start = @project.versions.open.map(&:sprint_start_date).compact.min
        sprint_end = @project.versions.open.map(&:effective_date).compact.max

        from << first_time_entry if first_time_entry
        from << sprint_start if sprint_start
        @from = from.min
        unless @from.present?
          from << @project.versions.min_by(&:created_on).created_on.to_date if @project.versions.min_by(&:created_on).present?
          @from = from.min || Date.today
        end

        to << last_time_entry if last_time_entry
        to << sprint_end if sprint_end
        @to = to.max
        unless @to.present?
          to << @project.versions.max_by(&:created_on).created_on.to_date if @project.versions.max_by(&:created_on).present?
          @to = to.max || Date.today
        end
      else
        sprint_start = @version.try(:sprint_start_date)
        sprint_end = @version.try(:effective_date)

        from << first_time_entry if first_time_entry
        from << sprint_start if sprint_start.present?
        @from = from.min
        @from = [ @version.try(:created_on).to_date, Date.today ].min unless @from.present? unless @from.present?

        to << last_time_entry if last_time_entry
        to << sprint_end if sprint_end.present?
        @to = to.max
        @to = [ @version.try(:created_on).to_date, Date.today].max unless @to.present?
       end

      @days = (@from..@to)
    end

  end
end
