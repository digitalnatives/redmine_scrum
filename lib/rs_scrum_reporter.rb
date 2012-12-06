module RS 
  class ScrumReporter
    attr_reader :issues, :days, :sum_estimated_hours, :sum_spent_hours, :sum_remaining_hours

    def initialize(project, version)
      @project = project
      @version = version

      run
      set_up_day_range
    end

    def available_criteria
      @available_criteria || load_available_criteria
    end

    def csv_days
      @csv_days ||= @days.inject([]){ |days, day| days.push(day, day) }
    end


    def story_spent(day, tasks)
      return unless story_entries_on(day,tasks).present?
      @story_entries.map(&:hours).sum
    end

    def story_remain(day, tasks)
      return unless story_entries_on(day,tasks).present?

      sum = 0 
      @story_entries.group_by(&:issue_id).each do |issue, entries|
        sum += entries.sort_by(&:updated_on).last.te_remaining_hours
      end

      sum
    end

    def daily_total(day)
      entries_on(day).map(&:hours).sum
    end

    def daily_remain(day)
      entries_on(day).group_by(&:issue_id).each do |issue,entries|
        entry = entries.sort_by(&:updated_on).last
        index = @issues.index(entry.issue)
        @issues[index].remaining_hours = entry.te_remaining_hours
      end

      @issues.sum(&:remaining_hours)
    end

    private

    def story_entries_on(day,tasks)
      unless @story_day == day
        @story_entries = tasks.map(&:time_entries).flatten.select{ |te| te.spent_on == day}
        @story_day = day
      end
      @story_entries
    end

    def entries_on(day)
      unless @day == day
        @day_time_entries = @issues.map(&:time_entries).flatten.select{ |te| te.spent_on == day}
        @day = day
      end
      @day_time_entries
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
                           issues.remaining_hours, 
                           issues.estimated_hours, 
                           issues.assigned_to_id,
                           sum(time_entries.hours) AS spent_time,
                           min(time_entries.spent_on) AS first_time_entry,
                           max(time_entries.spent_on) AS last_time_entry",
                           :joins => "LEFT JOIN time_entries ON (time_entries.issue_id = issues.id)",
                           :include => [ :status, :assigned_to ],
                           :conditions => [ @conditions, @condition_vars ],
                           :group => 'issues.id',
                           :order => 'issues.parent_id DESC, issues.id ASC')
      @daily_remain = @sum_estimated_hours = @issues.sum(&:estimated_hours) 
      @sum_spent_hours = @issues.map(&:spent_time).compact.map(&:to_f).sum
      @sum_remaining_hours = @issues.sum(&:remaining_hours)
    end

    def default_conditions
      @conditions = "issues.project_id = :project_id 
                  AND issues.tracker_id = :tracker_id
                  AND issues.estimated_hours IS NOT NULL"
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
        sprint_start = @project.versions.min_by(&:sprint_start_date).try(:sprint_start_date)
        sprint_end = @project.versions.max_by(&:effective_date).try(:effective_date)

        from << first_time_entry if first_time_entry
        from << sprint_start if sprint_start
        @from = from.min
        from = [ @project.versions.min_by(&:created_on).try(:created_on).to_date, Date.today ].min unless @from.present?

        to << last_time_entry if last_time_entry
        to << sprint_end if sprint_end
        @to = to.max
        @to = [ @project.versions.max_by(&:created_on).try(:created_on).to_date, Date.today].max unless @to.present?
      else
        sprint_start = @version.try(:sprint_start_date)
        sprint_end = @version.try(:effective_date)

        from << sprint_start if sprint_start
        @from = from.min
        @form = [ @version.try(:created_on).to_date, Date.today ].min unless @from.present?

        to << sprint_end if sprint_end
        @to = to.max
        @to = [ @version.try(:created_on).to_date, Date.today].max unless @to.present?
       end

      @days = (@from..@to)
    end

  end
end
