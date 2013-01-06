module RS 
  class ScrumReporter
    attr_reader :issues, :days, :sum_estimated_hours, :sum_spent_hours, :sum_remaining_hours

    def initialize(project, version)
      @project = project
      @version = version

      run
      set_up_day_range
      set_up_day_data
    end

    def available_criteria
      @available_criteria || load_available_criteria
    end

    def csv_days
      @csv_days ||= @days.inject([]){ |days, day| days.push(day, day) }
    end

    def issue_spent(day, task)
      @data[day][task.id][:spent]
    end

    def issue_remain(day, task)
      @data[day][task.id][:left]
    end

    def has_time_entry?(day, task)
      @data[day][task.id][:has_time_entry]
    end

    def assignee_te(day, task)
      @data[day][task.id][:assignee_te]
    end

    def daily_spent(day)
      @data[day][:sum][:spent]
    end

    def daily_remain(day)
      @data[day][:sum][:left]
    end

    def story_spent(day, story_id)
      sum = 0
      @data[day].each do |key, value|
        sum += value[:spent] if value[:story_id] == story_id
      end
      sum
    end

    def story_remain(day, story_id)
      sum = 0
      @data[day].each do |key, value|
        sum += value[:left] if value[:story_id] == story_id
      end
      sum
    end

    private

    def set_up_day_data
      @data = {}
      @days.to_a.each do |day|
        @data[day] = {}
        sum_data = {}
        sum_data[:spent] = 0
        sum_data[:left] = 0
        @issues.each do |issue|
          issue_data = {}

          issue_entries = issue.time_entries.select{ |te| te.spent_on == day }.sort_by(&:updated_on)
          entry = issue_entries.last

          if entry.try(:te_remaining_hours).present?
            issue.left_hours = entry.te_remaining_hours.to_f
          end

          issue_data[:left] = issue.left_hours.to_f
          issue_data[:spent] = issue_entries.compact.sum(&:hours)
          issue_data[:has_time_entry] = (issue_entries.present? ? true : false)
          issue_data[:assignee_te] = issue_entries.find{ |te| te.user_id == issue.assigned_to_id }
          issue_data[:story_id] = issue.parent_id
          @data[day][issue.id] = issue_data

          sum_data[:spent] += issue_data[:spent]
          sum_data[:left] += issue_data[:left]
        end

        @data[day][:sum] = sum_data
      end
    end

    def story_entries_on(day,tasks)
      unless @story_day == day
        @story_entries = tasks.map(&:time_entries).flatten.select{ |te| te.spent_on == day}
        @story_day = day
      end
      @story_entries
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
                           issues.subject, 
                           COALESCE(issues.remaining_hours, 0) AS remaining_hours,
                           COALESCE(issues.estimated_hours, 0) AS estimated_hours,
                           COALESCE(issues.estimated_hours, 0) AS left_hours,
                           issues.assigned_to_id,
                           sum(time_entries.hours) AS spent_time,
                           min(time_entries.spent_on) AS first_time_entry,
                           max(time_entries.spent_on) AS last_time_entry",
                           :joins => "LEFT JOIN time_entries ON (time_entries.issue_id = issues.id)",# LEFT JOIN versions ON issues.fixed_version_id = versions.id",
                           :include => [ :status, :assigned_to ],
                           :conditions => [ @conditions, @condition_vars ],
                           :group => 'issues.id',
                           :order => 'issues.parent_id DESC, issues.id ASC')
      @sum_estimated_hours = @issues.sum(&:estimated_hours) 
      @sum_spent_hours = @issues.map(&:spent_time).compact.map(&:to_f).sum
      @sum_remaining_hours = @issues.sum(&:remaining_hours)
    end

    def default_conditions
      @conditions = "issues.project_id = :project_id 
                  AND issues.tracker_id = :tracker_id
                  AND issues.estimated_hours IS NOT NULL"
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
        sprint_end = @project.versions.open.map(&:effective_date).compact.min

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

        from << sprint_start if sprint_start.present?
        @from = from.min
        @from = [ @version.try(:created_on).to_date, Date.today ].min unless @from.present? unless @from.present?

        to << sprint_end if sprint_end.present?
        @to = to.max
        @to = [ @version.try(:created_on).to_date, Date.today].max unless @to.present?
       end

      @days = (@from..@to)
    end

  end
end
